import requests
from app.blockchain.block import Block

class Node:
    def __init__(self):
        self.nodes=set()

    def add(self,url): self.nodes.add(url)

    def broadcast(self,tx):
        for n in self.nodes:
            try: requests.post(n+"/tx/add",json=tx)
            except: pass

    def resolve(self, bc):
        new_chain = None
        max_len = len(bc.chain)
        for n in self.nodes:
            try:
                r = requests.get(n+"/chain").json()
                if len(r) > max_len:
                    max_len = len(r)
                    new_chain = r
            except: pass
        if new_chain:
            bc.chain = [self.rebuild(b) for b in new_chain]
            return True
        return False

    def rebuild(self, data):
        b = Block(data["index"], data["previous_hash"], data["transactions"], data["nonce"])
        b.timestamp = data["timestamp"]
        b.hash = data["hash"]
        return b