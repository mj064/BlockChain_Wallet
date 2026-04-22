import axios from "axios";

const API = "http://localhost:8000";

export const createWallet = (password) =>
    axios.post(`${API}/wallet/create`, { password });

export const sendTransaction = (data) =>
    axios.post(`${API}/transaction/broadcast`, data);

export const getChain = () =>
    axios.get(`${API}/chain`);

export const mineBlock = (address) =>
    axios.get(`${API}/mine/${address}`);