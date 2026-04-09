```mermaid
stateDiagram-v2
    [*] --> Auth
    Auth --> Login
    Auth --> Signup
    Login --> Home
    Signup --> Home
    Home --> Profile
    Home --> Simulator
    Profile --> Logout
    Simulator --> Quiz
    Simulator --> Results
    Results --> Home
```