# Long fixture for testing single-line edit in the middle (line ~45).
# Do not remove or reorder blocks; only the TARGET_CONSTANT line should change.

CONFIG_A = "default"
CONFIG_B = "default"
CONFIG_C = "default"

def helper_1():
    return 1
def helper_2():
    return 2
def helper_3():
    return 3
def helper_4():
    return 4
def helper_5():
    return 5

# ---- middle block ----
TARGET_CONSTANT = "change_me_to_updated"
# ---- end middle ----

def helper_6():
    return 6
def helper_7():
    return 7
def helper_8():
    return 8
def helper_9():
    return 9
def helper_10():
    return 10

def main():
    return TARGET_CONSTANT
