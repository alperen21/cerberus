from filter.personal_whitelist import PersonalWhitelist


whitelist = PersonalWhitelist(max_size=3)

whitelist.add("google.com")
whitelist.add("apple.com")
whitelist.add("ms.com")
whitelist.add("monster.com/list")

print(whitelist.check("google.com"))
print(whitelist.check("apple.com"))
print(whitelist.check("monster.com/list"))
print(whitelist.check("monster.com"))