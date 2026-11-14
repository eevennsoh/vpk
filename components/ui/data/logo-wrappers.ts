import { ThirdPartyLogoWrapper } from "@atlassian/logo-third-party/dist/esm/wrapper";
import { IconWrapper } from "@atlaskit/logo/dist/esm/utils/icon-wrapper";
import { LogoWrapper } from "@atlaskit/logo/dist/esm/utils/logo-wrapper";
import LegacyLogoWrapper from "@atlaskit/logo/dist/esm/wrapper";

/**
 * The logo modules load per logo, on first render (`logo-data.ts`, `logo-third-party-icons.ts`).
 * The wrappers every logo renders through (the third-party one draws an `@atlaskit/tile`) stay with
 * the page, with their stylesheets: Next does not hold a lazily loaded component until its
 * stylesheet arrives, so a lazy third-party logo drew its tile unstyled (27x30) and then shifted
 * to 24x24. The logo maps reference this list, which is what keeps these modules in the page; the
 * packages mark their scripts free of side effects, so a bare `import "…"` would be dropped.
 */
export const SHARED_LOGO_WRAPPERS = [ThirdPartyLogoWrapper, IconWrapper, LogoWrapper, LegacyLogoWrapper] as const;
