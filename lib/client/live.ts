// Is the client site LIVE on this server? (SPEC §26 v2.) Production stays dark after the cut-over deploy until
// CLIENT_SITE_SYNC=1 (the same switch that starts the book sync): nothing may create people, send invitations or import
// scripts there before it. Every other environment (staging, local) is always live.
import { IS_PRODUCTION } from "@/lib/site-env"

export const clientSiteLive = () => !IS_PRODUCTION || process.env.CLIENT_SITE_SYNC === "1"
export const NOT_LIVE = "The client site isn't live yet."
