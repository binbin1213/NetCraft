import re

# 复制密码验证函数到测试脚本，避免依赖其他模块
def validate_password(password: str) -> None:
    """
    Validate password complexity:
    - Minimum length: 8 characters
    - Maximum length: 128 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character from: !@#$%^&*()_+-=[]{}|;:,.<>?/~`
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if len(password) > 128:
        raise ValueError("Password must be at most 128 characters long")
    if not re.search(r'[A-Z]', password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r'[0-9]', password):
        raise ValueError("Password must contain at least one number")
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]', password):
        raise ValueError("Password must contain at least one special character")

# 测试函数
def run_tests():
    tests_passed = 0
    tests_failed = 0
    
    print("Running password validation tests...\n")
    
    # 测试1: 有效的密码
    test_cases = [
        ("Password1!", True, "Valid password"),
        ("Aa1!@#$%^&*()_+-=[]{}|;:,.<>?/~`", True, "Valid password with all special chars"),
        ("P@ssw0rd", True, "Valid password"),
        ("A1b2C3d4!", True, "Valid password with mixed chars"),
        ("X" * 8 + "a1!", True, "Valid password with 8 chars"),
        # 测试2: 密码长度问题
        ("Short1!", False, "Password too short"),
        ("A" * 129 + "a1!", False, "Password too long"),
        # 测试3: 缺少大写字母
        ("password1!", False, "Missing uppercase letter"),
        # 测试4: 缺少小写字母
        ("PASSWORD1!", False, "Missing lowercase letter"),
        # 测试5: 缺少数字
        ("Password!", False, "Missing digit"),
        # 测试6: 缺少特殊字符
        ("Password1", False, "Missing special character"),
        # 测试7: 边界情况
        ("A1a!bcde", True, "Exactly 8 characters"),
        ("A" * 123 + "a1!@#", True, "Exactly 128 characters"),
        ("A" * 124 + "a1!@#", False, "Over 128 characters"),
        # 测试8: 仅包含一种字符类型
        ("AAAAAAAAA", False, "Only uppercase letters"),
        ("aaaaaaaaa", False, "Only lowercase letters"),
        ("111111111", False, "Only digits"),
        ("!!!!!!!!!", False, "Only special characters"),
    ]
    
    for password, expected_valid, description in test_cases:
        try:
            validate_password(password)
            if expected_valid:
                print(f"✓ PASS: {description} - '{password}'")
                tests_passed += 1
            else:
                print(f"✗ FAIL: {description} - '{password}' expected to be invalid, but was valid")
                tests_failed += 1
        except ValueError as e:
            if not expected_valid:
                print(f"✓ PASS: {description} - '{password}' raised: {e}")
                tests_passed += 1
            else:
                print(f"✗ FAIL: {description} - '{password}' expected to be valid, but raised: {e}")
                tests_failed += 1
    
    # 测试特殊字符集
    print("\nTesting special characters...")
    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`"
    for char in special_chars:
        password = f"A1a{char}bcde"
        try:
            validate_password(password)
            print(f"✓ PASS: Special character '{char}' is allowed")
            tests_passed += 1
        except ValueError as e:
            print(f"✗ FAIL: Special character '{char}' should be allowed, but raised: {e}")
            tests_failed += 1
    
    # 测试不允许的特殊字符
    print("\nTesting invalid special characters...")
    invalid_chars = ['"', "'", '\\']
    for char in invalid_chars:
        password = f"A1a{char}bcde"
        try:
            validate_password(password)
            print(f"✗ FAIL: Special character '{char}' should be invalid, but was allowed")
            tests_failed += 1
        except ValueError as e:
            print(f"✓ PASS: Special character '{char}' is correctly rejected - {e}")
            tests_passed += 1
    
    total_tests = tests_passed + tests_failed
    print(f"\n{'='*50}")
    print(f"Test Results:")
    print(f"Total tests: {total_tests}")
    print(f"Passed: {tests_passed}")
    print(f"Failed: {tests_failed}")
    print(f"Success rate: {(tests_passed / total_tests) * 100:.1f}%")
    print(f"{'='*50}")

if __name__ == "__main__":
    run_tests()
