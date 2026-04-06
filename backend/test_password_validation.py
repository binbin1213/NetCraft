import pytest
from app.auth import validate_password
from app.models import UserCreate

# Test cases for password validation
def test_validate_password_valid():
    """Test that a valid password passes validation"""
    valid_passwords = [
        "Abc123!@#",
        "MyP@ssw0rd",
        "ComplexP@ssw0rdWithSpecialChars!@#$%^&*()_+-=[]{}|;:,.<>?/~`",
        "Short1!"  # Minimum length 8
    ]
    
    for password in valid_passwords:
        validate_password(password)  # Should not raise any exceptions
        # Also test with UserCreate model
        user = UserCreate(username="test", password=password)
        assert user.password == password

def test_validate_password_too_short():
    """Test that a password shorter than 8 characters fails validation"""
    short_passwords = [
        "Abc12!",  # 6 characters
        "A1!",      # 3 characters
        "",         # Empty string
        "a"         # Single character
    ]
    
    for password in short_passwords:
        with pytest.raises(ValueError, match="Password must be at least 8 characters long"):
            validate_password(password)
        
        with pytest.raises(ValueError):
            UserCreate(username="test", password=password)

def test_validate_password_too_long():
    """Test that a password longer than 128 characters fails validation"""
    long_password = "A" * 129 + "1!"
    
    with pytest.raises(ValueError, match="Password must be at most 128 characters long"):
        validate_password(long_password)
    
    with pytest.raises(ValueError):
        UserCreate(username="test", password=long_password)

def test_validate_password_missing_uppercase():
    """Test that a password without uppercase letters fails validation"""
    password = "password123!"
    
    with pytest.raises(ValueError, match="Password must contain at least one uppercase letter"):
        validate_password(password)
    
    with pytest.raises(ValueError):
        UserCreate(username="test", password=password)

def test_validate_password_missing_lowercase():
    """Test that a password without lowercase letters fails validation"""
    password = "PASSWORD123!"
    
    with pytest.raises(ValueError, match="Password must contain at least one lowercase letter"):
        validate_password(password)
    
    with pytest.raises(ValueError):
        UserCreate(username="test", password=password)

def test_validate_password_missing_number():
    """Test that a password without numbers fails validation"""
    password = "Password!"
    
    with pytest.raises(ValueError, match="Password must contain at least one number"):
        validate_password(password)
    
    with pytest.raises(ValueError):
        UserCreate(username="test", password=password)

def test_validate_password_missing_special_character():
    """Test that a password without special characters fails validation"""
    password = "Password123"
    
    with pytest.raises(ValueError, match="Password must contain at least one special character"):
        validate_password(password)
    
    with pytest.raises(ValueError):
        UserCreate(username="test", password=password)

def test_validate_password_only_special_characters():
    """Test that a password with only special characters fails validation"""
    password = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" * 2  # 32 special characters
    
    with pytest.raises(ValueError):
        validate_password(password)
    
    with pytest.raises(ValueError):
        UserCreate(username="test", password=password)

def test_validate_password_only_numbers():
    """Test that a password with only numbers fails validation"""
    password = "1234567890"
    
    with pytest.raises(ValueError):
        validate_password(password)
    
    with pytest.raises(ValueError):
        UserCreate(username="test", password=password)

def test_validate_password_only_letters():
    """Test that a password with only letters fails validation"""
    password = "Abcdefghij"
    
    with pytest.raises(ValueError):
        validate_password(password)
    
    with pytest.raises(ValueError):
        UserCreate(username="test", password=password)

# Run the tests if this file is executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
