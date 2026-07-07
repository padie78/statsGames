Actúa como un Arquitecto de Soluciones Cloud experto en AWS y sistemas serverless. Necesito crear la infraestructura base (IaC) para una plataforma de analítica gaming social y coaching con IA. El proyecto debe ser escalable, orientado a eventos y con un stack moderno.

Requerimientos del Proyecto:

Stack Frontend: Angular + Ionic (PWA/Mobile).

Infraestructura (IaC): Terraform.

Pipeline: GitHub Actions para CI/CD automatizado.

Stack Backend (AWS Serverless):

API Layer: AWS AppSync (GraphQL) para comunicación en tiempo real con Angular.

Auth: AWS Cognito (User Pools para gestión de usuarios gamer).

Compute: AWS Lambda (Node.js/TypeScript) para lógica de negocio y procesamiento de eventos.

Queue: AWS SQS para desacoplar la ingesta de datos de las APIs externas (Roblox/Fortnite).

Storage: S3 (para assets de perfiles) y DynamoDB (para perfiles unificados de usuario).

Data/Analytics: Glue + Athena (para analizar el histórico de partidas a gran escala).

Necesito que generes:

Estructura de Directorios: Define la jerarquía del repositorio (incluyendo carpetas para terraform/, src/frontend/, src/lambdas/, .github/workflows/).

Módulo de Terraform: Crea la configuración inicial (main.tf, variables.tf) que despliegue un AppSync GraphQL API, una tabla DynamoDB básica y un bucket S3.

Lambda de Ingesta: Un ejemplo de función Lambda en TypeScript que reciba un evento (simulando un webhook de un juego), lo encole en SQS y luego sea procesado.

Workflow de GitHub Actions: Un archivo .yml que valide el plan de Terraform y despliegue los cambios al hacer push a la rama 'main'.

Explicación del flujo de datos: Explica cómo conectarías el trigger inicial (el evento del juego) hasta que el usuario final recibe el push notification en su app Angular/Ionic.

Mantén una mentalidad de 'Infrastructure as Code' pura y asegura que los servicios estén debidamente conectados mediante IAM Roles con el principio de menor privilegio.