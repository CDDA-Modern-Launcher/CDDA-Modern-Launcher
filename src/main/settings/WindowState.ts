import { Rectangle, screen } from "electron";

export interface WindowState {
    bounds?: Rectangle;
    maximized: boolean;
}

const DEFAULT_BOUNDS: Rectangle = {
    x: 0,
    y: 0,
    width: 980,
    height: 700
};

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;
const MIN_VISIBLE_WIDTH = 120;
const MIN_VISIBLE_TITLE_HEIGHT = 32;

export function getDefaultWindowState(): WindowState {
    return { maximized: false };
}

export function parseWindowState(value: unknown): WindowState | null {
    if (!isRecord(value) || !isRecord(value.bounds)) return null;

    const { x, y, width, height } = value.bounds;
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return null;

    return {
        bounds: {
            x,
            y,
            width: Math.max(MIN_WIDTH, width),
            height: Math.max(MIN_HEIGHT, height)
        },
        maximized: value.maximized === true
    };
}

export function resolveWindowBounds(savedBounds: Rectangle | undefined): Rectangle {
    const primaryWorkArea = screen.getPrimaryDisplay().workArea;
    const source = savedBounds ?? {
        ...DEFAULT_BOUNDS,
        x: primaryWorkArea.x + Math.round((primaryWorkArea.width - DEFAULT_BOUNDS.width) / 2),
        y: primaryWorkArea.y + Math.round((primaryWorkArea.height - DEFAULT_BOUNDS.height) / 2)
    };

    const targetWorkArea = findBestWorkArea(source) ?? primaryWorkArea;
    const width = Math.min(Math.max(source.width, MIN_WIDTH), targetWorkArea.width);
    const height = Math.min(Math.max(source.height, MIN_HEIGHT), targetWorkArea.height);

    return {
        x: clamp(source.x, targetWorkArea.x - width + MIN_VISIBLE_WIDTH, targetWorkArea.x + targetWorkArea.width - MIN_VISIBLE_WIDTH),
        y: clamp(source.y, targetWorkArea.y, targetWorkArea.y + targetWorkArea.height - MIN_VISIBLE_TITLE_HEIGHT),
        width,
        height
    };
}

function findBestWorkArea(bounds: Rectangle): Rectangle | null {
    let bestArea: Rectangle | null = null;
    let bestIntersection = 0;

    for (const display of screen.getAllDisplays()) {
        const intersection = getIntersectionArea(bounds, display.workArea);
        if (intersection > bestIntersection) {
            bestIntersection = intersection;
            bestArea = display.workArea;
        }
    }

    return bestArea;
}

function getIntersectionArea(a: Rectangle, b: Rectangle): number {
    const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return width * height;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function attachWindowStatePersistence(window: import("electron").BrowserWindow, initialState: WindowState, save: (state: WindowState) => void): void {
    let normalBounds = resolveWindowBounds(initialState.bounds);
    let maximized = initialState.maximized;

    const saveNormalBounds = (): void => {
        if (window.isDestroyed() || window.isMinimized() || window.isMaximized() || window.isFullScreen()) return;
        normalBounds = window.getBounds();
        maximized = false;
        save({ bounds: normalBounds, maximized });
    };

    window.on("move", saveNormalBounds);
    window.on("resize", saveNormalBounds);
    window.on("maximize", () => {
        maximized = true;
        save({ bounds: normalBounds, maximized });
    });
    window.on("unmaximize", () => {
        maximized = false;
        normalBounds = window.getNormalBounds();
        save({ bounds: normalBounds, maximized });
    });
    window.on("close", () => {
        save({
            bounds: window.isMinimized() || window.isMaximized() || window.isFullScreen() ? normalBounds : window.getBounds(),
            maximized: window.isMinimized() || window.isFullScreen() ? maximized : window.isMaximized()
        });
    });
}
