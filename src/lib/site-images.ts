import barberInterior from "@/assets/barber-interior.webp";
import straightRazorShave from "@/assets/straight-razor-shave.webp";
import beardDetail from "@/assets/beard-detail.webp";
import scissorCutDetail from "@/assets/scissor-cut-detail.webp";
import fadeCloseup from "@/assets/fade-closeup.webp";
import barberChairRoom from "@/assets/barber-chair-room.webp";

export const SITE_IMAGES = {
  hero: barberInterior,
  about: barberChairRoom,
  whyChoose: barberChairRoom,
  services: scissorCutDetail,
  fade: fadeCloseup,
  shave: straightRazorShave,
  beard: beardDetail,
  gallery: [
    barberInterior,
    scissorCutDetail,
    fadeCloseup,
    straightRazorShave,
    beardDetail,
    barberChairRoom,
  ],
} as const;
