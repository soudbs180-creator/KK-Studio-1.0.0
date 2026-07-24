/**
 * Brand Memory Domain Contract & DTOs
 * Part of Miora Creative Studio integration (G2) for KK Studio.
 */

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent?: string;
  neutralDark?: string;
  neutralLight?: string;
  background?: string;
  gradients?: string[];
}

export interface TypographyRule {
  primaryFont: string;
  secondaryFont?: string;
  headingFont?: string;
  bodyFont?: string;
  customFontUrls?: string[];
}

export interface BrandGuideline {
  voiceAndTone: string[];
  designKeywords: string[];
  prohibitedElements: string[];
  dosAndDonts?: {
    dos: string[];
    donts: string[];
  };
}

export interface BrandProfile {
  id: string;
  ownerId: string;
  brandName: string;
  slogan?: string;
  industry?: string;
  targetAudience?: string;
  logoAssetId?: string;
  palette: ColorPalette;
  typography: TypographyRule;
  guidelines: BrandGuideline;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandProfileDto {
  brandName: string;
  slogan?: string;
  industry?: string;
  targetAudience?: string;
  logoAssetId?: string;
  palette: ColorPalette;
  typography: TypographyRule;
  guidelines?: Partial<BrandGuideline>;
  isDefault?: boolean;
}

export interface UpdateBrandProfileDto extends Partial<CreateBrandProfileDto> {
  id: string;
}
