import { startServer } from "./Lobby.js";

const port = Number(process.env.PORT || 8012);
startServer(port);
