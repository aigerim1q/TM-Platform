package ai

// RegisterAllProviders registers all available LLM providers
// This function is called from the main application to avoid circular imports
func RegisterAllProviders() {
	// Register all providers by using function references that will be set by the main package
	// This approach avoids direct imports of the provider packages
	registerBuiltinProviders()
}

// registerBuiltinProviders registers built-in providers using placeholder constructors
// The actual implementations are provided by the main package to avoid circular imports
func registerBuiltinProviders() {
	// Note: The actual constructors will be set by the main application package
	// to avoid importing the provider packages here which would create circular dependencies
}
