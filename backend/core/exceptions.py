from typing import Any, Dict

class MedSimException(Exception):
    """Base exception for the MedSim application."""
    def __init__(self, message: str, details: Dict[str, Any] = None):
        super().__init__(message)
        self.details = details or {}

class RepositoryError(MedSimException):
    """Raised when a persistence operation fails."""
    pass

class EntityNotFoundError(RepositoryError):
    """Raised when an entity is not found in the database."""
    pass

class PatientServiceError(MedSimException):
    """Excepción de negocio para PatientService."""
    pass
