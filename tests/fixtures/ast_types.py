class Alpha:
    def ping(self) -> str:
        return "pong"

    def health_check(self) -> bool:
        return True

class Beta:
    def ping(self, x: int = 0) -> int:
        return x

    def health_check(self) -> bool:
        return True