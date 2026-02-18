package prompt_engineering

// PromptTemplate represents a prompt template
type PromptTemplate struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Template    string   `json:"template"`
	Parameters  []string `json:"parameters"`
}

// PromptData holds data for prompt creation
type PromptData struct {
	DocumentContent string                 `json:"document_content"`
	JSONSchema      map[string]interface{} `json:"json_schema"`
}

// EmployeePool represents a pool of available employees for task assignment
type EmployeePool struct {
	Description            string                 `json:"description"`
	Version                string                 `json:"version"`
	Employees              []Employee             `json:"employees"`
	AssignmentInstructions map[string]string      `json:"assignment_instructions,omitempty"`
}

// Employee represents an employee in the pool
type Employee struct {
	Name           string   `json:"name"`
	Role           string   `json:"role"`
	RoleEN         string   `json:"role_en"`
	Specialization []string `json:"specialization,omitempty"`
	Keywords       []string `json:"keywords,omitempty"`
}
