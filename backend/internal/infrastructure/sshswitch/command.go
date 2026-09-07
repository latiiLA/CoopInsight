package sshswitch

func LoadATMCommand(institution, atm string) string {
	return "load_atm " + institution + " " + atm
}
