# Cataclysm Modern Launcher

Cataclysm Modern Launcher is a desktop launcher for **Cataclysm: Dark Days Ahead** and compatible forks.

The goal of the project is to provide a clean, modern, and convenient way to install, update, launch, and manage Cataclysm: DDA builds without manually downloading archives, unpacking them, moving saves, or tracking release assets by hand.

## Features

- Install Cataclysm: DDA builds from GitHub releases
- Manage multiple installed game versions
- Switch between installed versions
- Check for new available builds
- Download and unpack game archives with progress reporting
- Preserve and copy user data between versions
- Manage save backups
- Create automatic backups after game saves
- Create and restore manual backups
- Configure backup retention
- Support multiple game channels and forks
- Choose preferred release asset type when several archives are available
- Launch the selected game version directly from the launcher
- Localized user interface
- Support custom locale files from the workspace directory
- Light, dark, and system theme modes
- Built-in auto-update support for the launcher itself

## Supported Games and Channels

The launcher is designed for Cataclysm: Dark Days Ahead and compatible forks and release channels.

Built-in channels may include:

- Cataclysm: Dark Days Ahead
- Cataclysm: Bright Nights
- Cataclysm: There Is Still Hope
- Other compatible forks, depending on the current launcher configuration

Each channel defines its own GitHub repository, release source, and supported archive patterns.

## Game Version Management

The launcher can keep several installed game versions at the same time.

This allows you to:

- Install the latest available build
- Install an older build
- Switch back to a previous version
- Keep saves and user data separate from game binaries
- Remove versions you no longer need

When installing a new version, the launcher can copy user data from the currently active version if needed.

## Backups

The launcher includes a save backup system.

Backups can be created manually or automatically after the game writes save files. The backup system is designed to avoid relying on unreliable in-game save timestamps and instead watches actual save file changes.

Backup settings include:

- Enable or disable the backup system
- Enable or disable automatic backups
- Configure the minimum delay between automatic backups
- Configure how many manual backups should be kept
- Configure automatic backup retention

## Localization

The launcher supports localization.

Built-in locales are provided for:

- English
- Russian

When a workspace directory is selected, built-in locale files can be copied into the workspace-local `locales` directory. After that, the launcher can use those files as user-editable locale sources.

This allows users to customize translations without modifying the application itself.

## Themes

The launcher supports several theme modes:

- System
- Dark
- Light

Theme preference is stored in the application settings and is applied early during startup to avoid visual flashing.

## Development

This project is built with:

- Electron
- TypeScript
- React
- Vite
- electron-builder

## Project Structure

The project follows a typical Electron application structure with separated main process, preload, and renderer code.

The exact structure may change over time, but the main areas are:

- Electron main process
- Preload API
- React renderer UI
- Game installation and version management logic
- GitHub release integration
- Backup system
- Localization system
- Application settings
- Auto-update configuration

## Running Locally

Install dependencies:

```bash
npm install
```

Start the application in development mode:

```bash
npm run dev
```

Run linting:

```bash
npm run lint
```

Run type checking:

```bash
npm run typecheck
```

Build the application:

```bash
npm run build
```

Create a distributable package:

```bash
npm run dist
```

Available scripts may differ depending on the current package configuration.

## Auto Updates

The launcher uses Electron auto-update infrastructure through `electron-builder`.

Update metadata and release assets are published through GitHub Releases. The updater configuration is generated during packaging, so release repository settings must be kept in sync with the current publishing target.

The application identity should remain stable between releases. In particular, `appId` should not be changed casually, because it is used to identify the installed application.

## Configuration

Most user-facing settings are stored persistently by the application.

These include:

- Selected workspace directory
- Selected game channel
- Selected game version
- Preferred release asset type
- Backup settings
- Locale
- Theme mode

Some settings are stored in the application configuration, while workspace-local resources such as custom locale files may be stored inside the selected workspace directory.

## Status

The project is under active development.

The current focus is on making the launcher reliable, predictable, and comfortable for daily use with Cataclysm: DDA experimental builds and compatible forks.

## License

License information has not been finalized yet.
