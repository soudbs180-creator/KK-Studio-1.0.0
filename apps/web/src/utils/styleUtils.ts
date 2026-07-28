import type { AspectRatio } from '../types';

const coerceAspectRatio = (value: string): AspectRatio => value as unknown as AspectRatio;

const ASPECT_RATIO = {
    AUTO: coerceAspectRatio('auto'),
    SQUARE: coerceAspectRatio('1:1'),
    PORTRAIT_1_8: coerceAspectRatio('1:8'),
    PORTRAIT_1_4: coerceAspectRatio('1:4'),
    PORTRAIT_3_4: coerceAspectRatio('3:4'),
    PORTRAIT_4_5: coerceAspectRatio('4:5'),
    PORTRAIT_9_16: coerceAspectRatio('9:16'),
    PORTRAIT_9_21: coerceAspectRatio('9:21'),
    PORTRAIT_2_3: coerceAspectRatio('2:3'),
    LANDSCAPE_4_3: coerceAspectRatio('4:3'),
    LANDSCAPE_5_4: coerceAspectRatio('5:4'),
    LANDSCAPE_16_9: coerceAspectRatio('16:9'),
    LANDSCAPE_21_9: coerceAspectRatio('21:9'),
    LANDSCAPE_4_1: coerceAspectRatio('4:1'),
    LANDSCAPE_8_1: coerceAspectRatio('8:1'),
    LANDSCAPE_3_2: coerceAspectRatio('3:2'),
    STANDARD_2_3: coerceAspectRatio('2:3'),
    STANDARD_3_2: coerceAspectRatio('3:2'),
} as const satisfies Record<string, AspectRatio>;

export const CARD_WIDTHS = {
    LANDSCAPE: 320,
    SQUARE: 280,
    PORTRAIT: 240, // Increased from 200 for better text fit
};

export const FOOTER_HEIGHT = 36; // Canvas V3 keeps result metadata in one compact footer row.

/**
 * Returns the dimensions for a card based on aspect ratio.
 * @param aspectRatio The aspect ratio of the image/card
 * @param includeFooter Whether to include the footer height (for Image Cards)
 */
export const getCardDimensions = (aspectRatio?: AspectRatio, includeFooter: boolean = false) => {
    let width = CARD_WIDTHS.SQUARE;
    let imageHeight = 280; // Default 1:1

    if (!aspectRatio) {
        return {
            width: CARD_WIDTHS.SQUARE,
            imageHeight: 280,
            totalHeight: 280 + (includeFooter ? FOOTER_HEIGHT : 0)
        };
    }

    switch (aspectRatio) {
        case ASPECT_RATIO.LANDSCAPE_16_9:
        case ASPECT_RATIO.LANDSCAPE_21_9:
        case ASPECT_RATIO.LANDSCAPE_4_1:
        case ASPECT_RATIO.LANDSCAPE_8_1:
            width = CARD_WIDTHS.LANDSCAPE;
            if (aspectRatio === ASPECT_RATIO.LANDSCAPE_21_9) imageHeight = 137;
            else if (aspectRatio === ASPECT_RATIO.LANDSCAPE_4_1) imageHeight = 80;
            else if (aspectRatio === ASPECT_RATIO.LANDSCAPE_8_1) imageHeight = 40;
            else imageHeight = 180; // 16:9
            break;

        case ASPECT_RATIO.LANDSCAPE_4_3:
        case ASPECT_RATIO.LANDSCAPE_5_4:
            width = CARD_WIDTHS.LANDSCAPE;
            imageHeight = aspectRatio === ASPECT_RATIO.LANDSCAPE_5_4 ? 256 : 240;
            break;

        case ASPECT_RATIO.STANDARD_3_2:
        case ASPECT_RATIO.LANDSCAPE_3_2:
            width = CARD_WIDTHS.LANDSCAPE;
            imageHeight = 213;
            break;

        case ASPECT_RATIO.PORTRAIT_9_16:
        case ASPECT_RATIO.PORTRAIT_9_21:
            width = CARD_WIDTHS.PORTRAIT;
            imageHeight = aspectRatio === ASPECT_RATIO.PORTRAIT_9_21 ? 560 : 426;
            break;

        case ASPECT_RATIO.PORTRAIT_3_4:
        case ASPECT_RATIO.PORTRAIT_4_5:
            width = CARD_WIDTHS.PORTRAIT;
            imageHeight = aspectRatio === ASPECT_RATIO.PORTRAIT_4_5 ? 300 : 320;
            break;

        case ASPECT_RATIO.STANDARD_2_3:
        case ASPECT_RATIO.PORTRAIT_2_3:
            width = CARD_WIDTHS.PORTRAIT;
            imageHeight = 360;
            break;

        case ASPECT_RATIO.PORTRAIT_1_4:
        case ASPECT_RATIO.PORTRAIT_1_8:
            width = CARD_WIDTHS.PORTRAIT;
            imageHeight = aspectRatio === ASPECT_RATIO.PORTRAIT_1_8 ? 600 : 560; // Clamped from 1920/960 to prevent giant empty cards and layout distortion
            break;

        case ASPECT_RATIO.SQUARE:
        case ASPECT_RATIO.AUTO:
        default:
            width = CARD_WIDTHS.SQUARE;
            imageHeight = 280;
            break;
    }

    return {
        width,
        imageHeight, // Height of the visual image part
        totalHeight: imageHeight + (includeFooter ? FOOTER_HEIGHT : 0)
    };
};
