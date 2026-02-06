# Fixture for refactor semantic
class Greeter:
    def greet_person(self, name: str) -> str:
        return f"Hello {name}"


def main():
    g = Greeter()
    print(g.greet_person("Alice"))
