package prompt_engineering

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// PromptManager manages prompt templates and creation
type PromptManager struct {
	promptsDir   string
	prompts      map[string]PromptTemplate
	employeePool EmployeePool
	logger       interface{} // In a real implementation, we'd use a proper logger interface
}

// NewPromptManager creates a new prompt manager
func NewPromptManager(promptsDir string) *PromptManager {
	pm := &PromptManager{
		promptsDir: promptsDir,
		prompts:    make(map[string]PromptTemplate),
	}

	// Load all prompt templates
	pm.loadPrompts()

	// Load employee pool
	pm.loadEmployeePool()

	return pm
}

// loadPrompts loads all prompt templates from files
func (pm *PromptManager) loadPrompts() {
	if _, err := os.Stat(pm.promptsDir); os.IsNotExist(err) {
		// Create default prompts if directory doesn't exist
		pm.createDefaultPrompts()
		return
	}

	// Walk through the prompts directory and load JSON files
	err := filepath.WalkDir(pm.promptsDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if !d.IsDir() && strings.HasSuffix(strings.ToLower(path), ".json") {
			promptData, err := os.ReadFile(path)
			if err != nil {
				return fmt.Errorf("failed to read prompt file %s: %w", path, err)
			}

			var prompt PromptTemplate
			if err := json.Unmarshal(promptData, &prompt); err != nil {
				return fmt.Errorf("failed to unmarshal prompt from %s: %w", path, err)
			}

			// Use the file name (without extension) as the prompt name
			fileName := filepath.Base(path)
			promptName := strings.TrimSuffix(fileName, filepath.Ext(fileName))

			pm.prompts[promptName] = prompt
		}

		return nil
	})

	if err != nil {
		// If there's an error loading prompts, create default ones
		pm.createDefaultPrompts()
	}
}

// createDefaultPrompts creates default prompt templates
func (pm *PromptManager) createDefaultPrompts() {
	// Create prompts directory if it doesn't exist
	if err := os.MkdirAll(pm.promptsDir, 0755); err != nil {
		// If we can't create the directory, we'll work with an empty prompt map
		return
	}

	// Create default project extraction prompt
	extractionPrompt := PromptTemplate{
		Name:        "Project Structure Extraction",
		Description: "Extract project structure from ЖЦП documents",
		Template: `You are a project management expert specializing in Russian project lifecycle documents (ЖЦП). 
Extract the complete project structure from the following document content, identifying:

1. Project phases (main stages of the project)
2. Tasks within each phase
3. Timeline information (start/end dates)
4. Responsible persons and their roles
5. Task dependencies and relationships

Document content:
{document_content}

Extract this information and return ONLY a valid JSON object with the following structure:
{json_schema}

Important guidelines:
- Use Russian terminology where appropriate in the output
- If dates are not explicitly mentioned, set to null
- If responsible persons are not explicitly mentioned, set to empty array
- Estimate confidence scores based on clarity of information in the document
- Use UUID-like strings for IDs (e.g., "phase_1", "task_1_1")
- Keep descriptions concise but informative
- If you cannot determine certain information, use null values
- Do not include any explanatory text outside the JSON`,
		Parameters: []string{"document_content", "json_schema"},
	}

	// Save the default prompt
	promptData, err := json.MarshalIndent(extractionPrompt, "", "  ")
	if err != nil {
		return
	}

	promptPath := filepath.Join(pm.promptsDir, "project_extraction.json")
	if err := os.WriteFile(promptPath, promptData, 0644); err != nil {
		return
	}

	pm.prompts["project_extraction"] = extractionPrompt
}

// GetPrompt gets a formatted prompt with provided arguments
func (pm *PromptManager) GetPrompt(promptName string, args map[string]interface{}) (string, error) {
	promptTemplate, exists := pm.prompts[promptName]
	if !exists {
		return "", fmt.Errorf("prompt '%s' not found", promptName)
	}

	template := promptTemplate.Template

	// Replace placeholders with actual values
	for key, value := range args {
		placeholder := "{" + key + "}"
		var valueStr string

		switch v := value.(type) {
		case string:
			valueStr = v
		case map[string]interface{}:
			jsonBytes, err := json.MarshalIndent(v, "", "  ")
			if err != nil {
				return "", fmt.Errorf("failed to marshal JSON for placeholder '%s': %w", key, err)
			}
			valueStr = string(jsonBytes)
		default:
			valueStr = fmt.Sprintf("%v", v)
		}

		template = strings.ReplaceAll(template, placeholder, valueStr)
	}

	return template, nil
}

// CreateExtractionPrompt creates a specialized prompt for project structure extraction
func (pm *PromptManager) CreateExtractionPrompt(documentContent string, jsonSchema map[string]interface{}) (string, error) {
	// Format employee pool for prompt
	employeePoolStr := pm.formatEmployeePool()

	args := map[string]interface{}{
		"document_content": documentContent,
		"json_schema":      jsonSchema,
		"employee_pool":    employeePoolStr,
	}

	return pm.GetPrompt("project_extraction", args)
}

// AddPrompt adds a new prompt template
func (pm *PromptManager) AddPrompt(name string, template PromptTemplate) {
	pm.prompts[name] = template
}

// RemovePrompt removes a prompt template
func (pm *PromptManager) RemovePrompt(name string) {
	delete(pm.prompts, name)
}

// ListPrompts returns a list of available prompt names
func (pm *PromptManager) ListPrompts() []string {
	names := make([]string, 0, len(pm.prompts))
	for name := range pm.prompts {
		names = append(names, name)
	}
	return names
}

// GetPromptTemplate returns a specific prompt template
func (pm *PromptManager) GetPromptTemplate(name string) (PromptTemplate, bool) {
	template, exists := pm.prompts[name]
	return template, exists
}

// SavePrompt saves a prompt template to a file
func (pm *PromptManager) SavePrompt(name string, template PromptTemplate) error {
	// Create the prompt data
	promptData, err := json.MarshalIndent(template, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal prompt template: %w", err)
	}

	// Create the file path
	promptPath := filepath.Join(pm.promptsDir, name+".json")

	// Write the prompt to file
	if err := os.WriteFile(promptPath, promptData, 0644); err != nil {
		return fmt.Errorf("failed to write prompt to file: %w", err)
	}

	// Add to in-memory prompts
	pm.prompts[name] = template

	return nil
}

// UpdatePrompt updates an existing prompt template
func (pm *PromptManager) UpdatePrompt(name string, template PromptTemplate) error {
	// Check if prompt exists
	_, exists := pm.prompts[name]
	if !exists {
		return fmt.Errorf("prompt '%s' does not exist", name)
	}

	return pm.SavePrompt(name, template)
}

// loadEmployeePool loads the employee pool from JSON file
func (pm *PromptManager) loadEmployeePool() {
	employeePoolPath := filepath.Join(pm.promptsDir, "employee_pool.json")
	
	// Check if file exists
	if _, err := os.Stat(employeePoolPath); os.IsNotExist(err) {
		// Create default employee pool
		pm.createDefaultEmployeePool()
		return
	}

	// Read the file
	data, err := os.ReadFile(employeePoolPath)
	if err != nil {
		// If can't read, use default
		pm.createDefaultEmployeePool()
		return
	}

	// Unmarshal the JSON
	if err := json.Unmarshal(data, &pm.employeePool); err != nil {
		// If can't parse, use default
		pm.createDefaultEmployeePool()
		return
	}
}

// createDefaultEmployeePool creates a minimal default employee pool
func (pm *PromptManager) createDefaultEmployeePool() {
	pm.employeePool = EmployeePool{
		Description: "Default employee pool",
		Version:     "1.0",
		Employees: []Employee{
			{Name: "Алексей Петров", Role: "Руководитель проекта", RoleEN: "Project Manager"},
			{Name: "Иван Волков", Role: "Backend разработчик", RoleEN: "Backend Developer"},
			{Name: "Елена Новикова", Role: "Frontend разработчик", RoleEN: "Frontend Developer"},
			{Name: "Ольга Федорова", Role: "Тестировщик", RoleEN: "QA Engineer"},
			{Name: "Роман Белов", Role: "AI интегратор", RoleEN: "AI Integration Specialist"},
		},
	}
}

// formatEmployeePool formats the employee pool for use in prompts
func (pm *PromptManager) formatEmployeePool() string {
	if len(pm.employeePool.Employees) == 0 {
		return "No employee pool available"
	}

	var builder strings.Builder
	builder.WriteString("Available team members:\n\n")

	for _, emp := range pm.employeePool.Employees {
		builder.WriteString(fmt.Sprintf("- %s (%s / %s)\n", emp.Name, emp.Role, emp.RoleEN))
		if len(emp.Specialization) > 0 {
			builder.WriteString(fmt.Sprintf("  Специализация: %s\n", strings.Join(emp.Specialization, ", ")))
		}
		if len(emp.Keywords) > 0 {
			builder.WriteString(fmt.Sprintf("  Ключевые слова: %s\n", strings.Join(emp.Keywords, ", ")))
		}
	}

	return builder.String()
}

// GetEmployeePool returns the current employee pool
func (pm *PromptManager) GetEmployeePool() EmployeePool {
	return pm.employeePool
}
