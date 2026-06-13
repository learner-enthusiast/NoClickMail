import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { db } from "@repo/database";
import { env } from "../env";

export const corsair = createCorsair({
  database: db,
  kek: env.CORSAIR_KEK,
  multiTenancy: true,
  plugins: [
    gmail({
      authType: "oauth_2",
    }),
    googlecalendar({
      authType: "oauth_2",
    }),
  ],
});
