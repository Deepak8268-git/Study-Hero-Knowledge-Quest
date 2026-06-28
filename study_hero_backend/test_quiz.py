from quiz_generator import generate_questions_from_text

test_text = """
The Earth is the third planet from the Sun and the only astronomical object known to harbor life.
About 29.2% of Earth's surface is land and 70.8% is water.
Earth's atmosphere is composed mainly of nitrogen and oxygen.
"""

print("Testing quiz generation...")
result = generate_questions_from_text(test_text)
print("\nGenerated Quiz:")
print(result) 