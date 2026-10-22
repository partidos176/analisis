## AGENTS.md

### Reglas de desarrollo

- **Ningún componente nuevo debe superar las 500 líneas de código.** Si un componente crece más allá de ese límite, debe dividirse en subcomponentes o hooks reutilizables.
- Mantener los componentes pequeños, enfocados y testeables.

### Documentación

- El archivo `README.md` debe mantenerse actualizado con cualquier cambio relevante: nuevas funcionalidades, cambios de dependencias, comandos de build/deploy o cambios de configuración.
- Cualquier cambio que afecte al comportamiento del proyecto, dependencias o estructura debe reflejarse en el `README.md` en el mismo commit/PR.

### Tooling

- Usar `pnpm` para instalar/actualizar dependencias (`pnpm install`, `pnpm update`).
- Node.js mínimo: `>=22.23.4` (por vulnerabilidades de seguridad).
- Dependabot actualiza dependencias semanalmente (patch/minor); las major se gestionan manualmente.
