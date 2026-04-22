import hashlib, json, time

class Block:
    def __init__(self, i, prev, txs, nonce=0):
        self.index=i
        self.timestamp=time.time()
        self.transactions=txs
        self.previous_hash=prev
        self.nonce=nonce
        self.hash=self.calc()

    def calc(self):
        d = self.__dict__.copy()
        if "hash" in d: del d["hash"]
        return hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()