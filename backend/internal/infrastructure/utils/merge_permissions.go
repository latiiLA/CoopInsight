package utils

func MergePermissions(userPerms, rolePerms []string) []string {
	permMap := make(map[string]bool)

	for _, p := range userPerms {
		permMap[p] = true
	}
	for _, p := range rolePerms {
		permMap[p] = true
	}

	result := make([]string, 0, len(permMap))
	for p := range permMap {
		result = append(result, p)
	}
	return result
}
