export const APP_MODAL_PROPS = {
    centered: true,
    radius: "lg",
    zIndex: 3000,
    overlayProps: { backgroundOpacity: 0.45, blur: 8 },
    transitionProps: { transition: "pop", duration: 180 }
} as const;
