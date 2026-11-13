import barberInteriorAsset from "@/assets/barber-interior.webp.asset.json";
import straightRazorShaveAsset from "@/assets/straight-razor-shave.webp.asset.json";
import beardDetailAsset from "@/assets/beard-detail.webp.asset.json";
import scissorCutDetailAsset from "@/assets/scissor-cut-detail.webp.asset.json";
import fadeCloseupAsset from "@/assets/fade-closeup.webp.asset.json";
import barberChairRoomAsset from "@/assets/barber-chair-room.webp.asset.json";

export const SITE_IMAGES = {
  hero: barberInteriorAsset.url,
  about: barberChairRoomAsset.url,
  whyChoose: barberChairRoomAsset.url,
  services: scissorCutDetailAsset.url,
  fade: fadeCloseupAsset.url,
  shave: straightRazorShaveAsset.url,
  beard: beardDetailAsset.url,
  gallery: [
    barberInteriorAsset.url,
    scissorCutDetailAsset.url,
    fadeCloseupAsset.url,
    straightRazorShaveAsset.url,
    beardDetailAsset.url,
    barberChairRoomAsset.url,
  ],
} as const;
