import g01 from "@/assets/gallery-01.webp.asset.json";
import g02 from "@/assets/gallery-02.webp.asset.json";
import g03 from "@/assets/gallery-03.webp.asset.json";
import g04 from "@/assets/gallery-04.webp.asset.json";
import g05 from "@/assets/gallery-05.webp.asset.json";
import g06 from "@/assets/gallery-06.webp.asset.json";
import g07 from "@/assets/gallery-07.webp.asset.json";
import g08 from "@/assets/gallery-08.webp.asset.json";
import g09 from "@/assets/gallery-09.webp.asset.json";
import g10 from "@/assets/gallery-10.webp.asset.json";
import g11 from "@/assets/gallery-11.webp.asset.json";
import g12 from "@/assets/gallery-12.webp.asset.json";
import g13 from "@/assets/gallery-13.webp.asset.json";
import g14 from "@/assets/gallery-14.webp.asset.json";
import g15 from "@/assets/gallery-15.webp.asset.json";

import n01 from "@/assets/gallery-new-2023-03-20.webp.asset.json";
import n02 from "@/assets/gallery-new-2023-03-20_1.webp.asset.json";
import n03 from "@/assets/gallery-new-2023-07-19.webp.asset.json";
import n04 from "@/assets/gallery-new-2023-07-19_1.webp.asset.json";
import n05 from "@/assets/gallery-new-2025-10-31.webp.asset.json";
import n06 from "@/assets/gallery-new-2025-10-31_2.webp.asset.json";
import n07 from "@/assets/gallery-new-WhatsApp_Image_2022-06-22_at_1.42.26_PM_5.webp.asset.json";

import b01 from "@/assets/gallery-b1.webp.asset.json";
import b02 from "@/assets/gallery-b2.webp.asset.json";
import b03 from "@/assets/gallery-b3.webp.asset.json";
import b04 from "@/assets/gallery-b4.webp.asset.json";
import b05 from "@/assets/gallery-b5.webp.asset.json";
import b06 from "@/assets/gallery-b6.webp.asset.json";

import { SITE_IMAGES } from "@/lib/site-images";

export const GALLERY_IMAGES: string[] = [
  b01.url, b02.url, b03.url, b04.url, b05.url, b06.url,
  n01.url, n02.url, n03.url, n04.url, n05.url, n06.url, n07.url,
  g01.url, g02.url, g03.url, g04.url, g05.url, g06.url, g07.url, g08.url,
  g09.url, g10.url, g11.url, g12.url, g13.url, g14.url, g15.url,
  ...SITE_IMAGES.gallery,
];
