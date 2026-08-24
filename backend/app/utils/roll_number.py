import re

def extract_roll_sequence(roll_number: str) -> int:
    """
    Extracts the trailing numeric sequence from a roll number string.
    If no trailing digits are found, returns 0.
    
    Examples:
    'STU-AIDS-001' -> 1
    '1050' -> 1050
    'ABC' -> 0
    """
    if not roll_number:
        return 0
        
    match = re.search(r'(\d+)$', roll_number.strip())
    if match:
        return int(match.group(1))
    return 0
