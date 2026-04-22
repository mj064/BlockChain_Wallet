import axios from "axios";
const API = "http://localhost:8000";

export const createWallet   = password  => axios.post(API + "/wallet", { password });
export const getChain       = ()        => axios.get(API + "/chain");
export const mine           = addr      => axios.get(API + "/mine/" + addr);
export const getBalance     = addr      => axios.get(API + "/balance/" + addr);
export const getTxHistory   = addr      => axios.get(API + "/history/" + addr);
export const getMempool     = ()        => axios.get(API + "/mempool");
export const getStats       = ()        => axios.get(API + "/stats");
export const getNodes       = ()        => axios.get(API + "/nodes");
export const addNode        = url       => axios.post(API + "/node/add", { url });
export const resolveChain   = ()        => axios.get(API + "/resolve");
export const sendTx         = data      => axios.post(API + "/tx/add", data);
export const createTx       = data      => axios.post(API + "/tx", data);