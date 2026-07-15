from enum import Enum, auto

class ErrorCategory(Enum):
    RATE_LIMIT = auto()
    NETWORK_FAILURE = auto()
    TIMEOUT = auto()
    UNAVAILABLE = auto()
    UNKNOWN = auto()

def categorize_provider_error(error: Exception) -> ErrorCategory:
    """
    Categorize a generic Exception into a logical AI provider error category.
    This is provider-agnostic.
    """
    error_str = str(error).lower()
    
    if any(keyword in error_str for keyword in ["429", "rate limit", "too many requests", "quota"]):
        return ErrorCategory.RATE_LIMIT
    
    if any(keyword in error_str for keyword in ["timeout", "timed out", "read timeout", "deadline exceeded"]):
        return ErrorCategory.TIMEOUT
        
    if any(keyword in error_str for keyword in ["connection error", "network error", "connection refused", "dns", "socket"]):
        return ErrorCategory.NETWORK_FAILURE
        
    if any(keyword in error_str for keyword in ["500", "502", "503", "504", "unavailable", "server error"]):
        return ErrorCategory.UNAVAILABLE
        
    return ErrorCategory.UNKNOWN

def get_user_facing_error(error: Exception) -> str:
    """
    Convert an AI provider error into a clean, safe, user-facing string.
    """
    category = categorize_provider_error(error)
    
    if category == ErrorCategory.RATE_LIMIT:
        return "The AI provider is currently busy. Please try again in a moment."
    elif category == ErrorCategory.NETWORK_FAILURE:
        return "The AI provider is temporarily unavailable due to a network error. Please try again later."
    elif category == ErrorCategory.TIMEOUT:
        return "The request to the AI provider timed out. Please try again."
    elif category == ErrorCategory.UNAVAILABLE:
        return "The AI provider is temporarily unavailable. Please try again later."
    else:
        return "An unexpected error occurred while generating the response."
