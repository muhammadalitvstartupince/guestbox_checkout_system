import { Poppins } from "next/font/google";

// Shared font for admin-designed rich text (checkout hero, add-on
// descriptions) — applied both in the editor and where that HTML is
// rendered, so what the admin sees while typing matches the live page.
export const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800"] });

/** @deprecated Alias kept so existing imports don't break — points to Poppins. */
export const montserrat = poppins;
