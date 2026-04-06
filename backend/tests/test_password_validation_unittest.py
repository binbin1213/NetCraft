import unittest
import sys
import os

# 将项目根目录添加到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.auth import validate_password
from app.models import UserCreate

class TestPasswordValidation(unittest.TestCase):
    # 测试有效的密码情况
    def test_valid_password(self):
        """测试符合所有复杂度要求的密码"""
        valid_passwords = [
            "Password1!",
            "Aa1!@#$%^&*()_+-=[]{}|;:,.<>?/~`",
            "P@ssw0rd",
            "A1b2C3d4!",
            "X" * 8 + "a1!"  # 边界长度：8字符
        ]
        
        for password in valid_passwords:
            validate_password(password)  # 不应抛出异常
            # 同时测试UserCreate模型的验证
            user = UserCreate(username="testuser", password=password)
            self.assertEqual(user.password, password)
    
    # 测试密码长度问题
    def test_password_too_short(self):
        """测试密码长度小于8字符的情况"""
        with self.assertRaises(ValueError) as context:
            validate_password("Short1!")
        self.assertIn("at least 8 characters", str(context.exception))
    
    def test_password_too_long(self):
        """测试密码长度超过128字符的情况"""
        long_password = "A" * 129 + "a1!"
        with self.assertRaises(ValueError) as context:
            validate_password(long_password)
        self.assertIn("at most 128 characters", str(context.exception))
    
    # 测试缺少大写字母
    def test_missing_uppercase(self):
        """测试缺少大写字母的情况"""
        with self.assertRaises(ValueError) as context:
            validate_password("password1!")
        self.assertIn("uppercase letter", str(context.exception))
    
    # 测试缺少小写字母
    def test_missing_lowercase(self):
        """测试缺少小写字母的情况"""
        with self.assertRaises(ValueError) as context:
            validate_password("PASSWORD1!")
        self.assertIn("lowercase letter", str(context.exception))
    
    # 测试缺少数字
    def test_missing_digit(self):
        """测试缺少数字的情况"""
        with self.assertRaises(ValueError) as context:
            validate_password("Password!")
        self.assertIn("at least one number", str(context.exception))
    
    # 测试缺少特殊字符
    def test_missing_special_char(self):
        """测试缺少特殊字符的情况"""
        with self.assertRaises(ValueError) as context:
            validate_password("Password1")
        self.assertIn("special character", str(context.exception))
    
    # 测试特殊字符集
    def test_valid_special_chars(self):
        """测试所有允许的特殊字符"""
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`"
        for char in special_chars:
            password = f"A1a{char}bcde"
            validate_password(password)  # 不应抛出异常
    
    # 测试不允许的特殊字符
    def test_invalid_special_chars(self):
        """测试不在允许列表中的特殊字符"""
        invalid_chars = ['"', '\\']  # 引号和反斜杠不在允许列表中
        for char in invalid_chars:
            password = f"A1a{char}bcde"
            with self.assertRaises(ValueError) as context:
                validate_password(password)
            self.assertIn("special character", str(context.exception))
    
    # 测试边界情况
    def test_boundary_lengths(self):
        """测试边界长度的情况"""
        # 刚好8字符
        validate_password("A1a!bcde")
        
        # 刚好128字符
        long_password = "A" * 123 + "a1!@#"
        validate_password(long_password)
        
        # 超过128字符
        with self.assertRaises(ValueError):
            validate_password("A" * 124 + "a1!@#")
    
    # 测试仅包含一种字符类型
    def test_only_one_char_type(self):
        """测试仅包含一种字符类型的情况"""
        # 仅包含大写字母
        with self.assertRaises(ValueError):
            validate_password("AAAAAAAAA")
        
        # 仅包含小写字母
        with self.assertRaises(ValueError):
            validate_password("aaaaaaaaa")
        
        # 仅包含数字
        with self.assertRaises(ValueError):
            validate_password("111111111")
        
        # 仅包含特殊字符
        with self.assertRaises(ValueError):
            validate_password("!!!!!!!!!")
    
    # 测试UserCreate模型的密码验证
    def test_user_create_password_validation(self):
        """测试UserCreate模型的密码验证"""
        # 有效的密码应该能创建成功
        UserCreate(username="testuser", password="Password1!")
        
        # 无效的密码应该抛出异常
        with self.assertRaises(ValueError):
            UserCreate(username="testuser", password="short1!")
        
        with self.assertRaises(ValueError):
            UserCreate(username="testuser", password="Nouppercase1!")
        
        with self.assertRaises(ValueError):
            UserCreate(username="testuser", password="NOLOWERCASE1!")
        
        with self.assertRaises(ValueError):
            UserCreate(username="testuser", password="NoDigit!")
        
        with self.assertRaises(ValueError):
            UserCreate(username="testuser", password="NoSpecialChar1")

if __name__ == "__main__":
    unittest.main()
