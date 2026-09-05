package sshswitch

func LoadATMCommand(institution, atm string) string {
	inner := "load_atm " + shellQuote(institution) + " " + shellQuote(atm)
	return LoginShellCommand(inner)
}
