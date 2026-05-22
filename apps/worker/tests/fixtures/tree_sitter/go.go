package review

import (
	"fmt"
	alias "strings"
)

type Runner struct {
	Name string
}

func Normalize(value string) string {
	return strings.TrimSpace(value)
}

func (r Runner) Run() string {
	return fmt.Sprintf("%s", Normalize(r.Name))
}
