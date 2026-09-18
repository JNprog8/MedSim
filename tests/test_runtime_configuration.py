import asyncio
import unittest
from unittest.mock import AsyncMock, patch
from urllib.parse import unquote, urlsplit

from pydantic import ValidationError

from backend.core.config import Settings
from backend import main, run
from backend.core import database


class RuntimeConfigurationTests(unittest.TestCase):
    def test_launcher_honors_environment_configuration(self):
        with patch.dict("os.environ", {
            "PORT": "9123", "HOST": "127.0.0.1", "DEBUG": "False",
            "LOG_LEVEL": "warning", "ACCESS_LOG": "False",
            "PROXY_HEADERS": "True", "FORWARDED_ALLOW_IPS": "10.0.0.2",
            "GRACEFUL_TIMEOUT_SECONDS": "42",
        }, clear=True):
            config = Settings(_env_file=None)
        with patch.object(run, "settings", config), patch.object(run.uvicorn, "run") as start:
            run.run()
        self.assertEqual(start.call_args.kwargs, {
            "host": "127.0.0.1", "port": 9123, "reload": False,
            "workers": 1, "log_level": "warning", "access_log": False,
            "proxy_headers": True, "forwarded_allow_ips": "10.0.0.2",
            "timeout_graceful_shutdown": 42,
        })

    def test_invalid_port_is_rejected(self):
        with self.assertRaises(ValidationError):
            Settings(_env_file=None, PORT=70000)

    def test_mongo_credentials_with_reserved_characters(self):
        config = Settings(
            _env_file=None, MONGO_URL="mongodb://mongo:27017/medsim",
            MONGO_USER="app@university", MONGO_PASSWORD="test:/@#$%",
        )
        with (
            patch.object(database, "settings", config),
            patch.object(database, "db_instance", database.Database()),
            patch.object(database.asyncio, "sleep", AsyncMock()),
            patch.object(database, "socket") as sockets,
            patch.object(database, "AsyncIOMotorClient") as create_client,
        ):
            create_client.return_value.admin.command = AsyncMock()
            sockets.socket.return_value.connect_ex.return_value = 0
            asyncio.run(database.connect_to_mongo())
        uri = urlsplit(create_client.call_args.args[0])
        self.assertEqual(unquote(uri.username), config.MONGO_USER)
        self.assertEqual(unquote(uri.password), config.MONGO_PASSWORD)
        self.assertEqual(uri.hostname, "mongo")
        self.assertEqual(uri.query, "authSource=admin")

    def test_demo_bootstrap_can_be_disabled_and_enabled(self):
        async def check(enabled):
            config = Settings(_env_file=None, BOOTSTRAP_DEMO=enabled)
            bootstrap = AsyncMock()
            with (
                patch.object(main, "settings", config),
                patch.object(main, "connect_to_mongo", AsyncMock()),
                patch.object(main, "close_mongo_connection", AsyncMock()),
                patch.object(main, "get_database"),
                patch.object(main.services, "wire"),
                patch.object(main, "bootstrap_demo_data", bootstrap),
            ):
                async with main.lifespan(main.app):
                    pass
            self.assertEqual(bootstrap.await_count, int(enabled))

        for enabled in (False, True):
            asyncio.run(check(enabled))


if __name__ == "__main__":
    unittest.main()
