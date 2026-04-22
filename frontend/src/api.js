import axios from "axios";
const API = "http://localhost:8000";

export const createWallet = p => axios.post(API + "/wallet", { password: p });
export const getChain = () => axios.get(API + "/chain");
export const mine = a => axios.get(API + "/mine/" + a);