package zhcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed == "" {
		trimmed = "http://localhost:8081"
	}

	return &Client{
		baseURL: trimmed,
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

type parseUploadResponse struct {
	JobID  string `json:"jobId"`
	Status string `json:"status"`
}

type parseStatusResponse struct {
	JobID    string `json:"jobId"`
	Status   string `json:"status"`
	Progress int    `json:"progress"`
	Error    string `json:"error"`
}

type ParseResultResponse struct {
	Success          bool              `json:"success"`
	ProjectStructure *ProjectStructure `json:"project_structure"`
	Error            *ParserError      `json:"error"`
}

type ParserError struct {
	Message string `json:"message"`
}

type ProjectStructure struct {
	Project ParsedProject `json:"project"`
}

type ParsedProject struct {
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Deadline    string        `json:"deadline"`
	Phases      []ParsedPhase `json:"phases"`
}

type ParsedPhase struct {
	Name      string       `json:"name"`
	StartDate string       `json:"start_date"`
	EndDate   string       `json:"end_date"`
	Tasks     []ParsedTask `json:"tasks"`
}

type ParsedTask struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

func (c *Client) ParseDocument(ctx context.Context, filename string, contentType string, data []byte) (*ParseResultResponse, error) {
	jobID, err := c.upload(ctx, filename, contentType, data)
	if err != nil {
		return nil, err
	}

	if err := c.waitForCompletion(ctx, jobID); err != nil {
		return nil, err
	}

	return c.fetchResult(ctx, jobID)
}

func (c *Client) upload(ctx context.Context, filename string, contentType string, data []byte) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}
	if contentType != "" {
		_ = writer.WriteField("content_type", contentType)
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	endpoint, err := c.joinPath("/api/parse/upload")
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		raw, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("parser upload failed: %s", strings.TrimSpace(string(raw)))
	}

	var payload parseUploadResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}
	if strings.TrimSpace(payload.JobID) == "" {
		return "", fmt.Errorf("parser upload returned empty job id")
	}

	return payload.JobID, nil
}

func (c *Client) waitForCompletion(ctx context.Context, jobID string) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		status, err := c.fetchStatus(ctx, jobID)
		if err != nil {
			return err
		}

		switch strings.ToLower(status.Status) {
		case "completed":
			return nil
		case "failed":
			if status.Error != "" {
				return fmt.Errorf("parser failed: %s", status.Error)
			}
			return fmt.Errorf("parser failed")
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (c *Client) fetchStatus(ctx context.Context, jobID string) (*parseStatusResponse, error) {
	endpoint, err := c.joinPath("/api/parse/status/" + jobID)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("parser status failed: %s", strings.TrimSpace(string(raw)))
	}

	var payload parseStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	return &payload, nil
}

func (c *Client) fetchResult(ctx context.Context, jobID string) (*ParseResultResponse, error) {
	endpoint, err := c.joinPath("/api/parse/result/" + jobID)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("parser result failed: %s", strings.TrimSpace(string(raw)))
	}

	var payload ParseResultResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if !payload.Success {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return nil, fmt.Errorf("parser returned unsuccessful result: %s", payload.Error.Message)
		}
		return nil, fmt.Errorf("parser returned unsuccessful result")
	}
	if payload.ProjectStructure == nil {
		return nil, fmt.Errorf("parser returned empty project structure")
	}

	return &payload, nil
}

func (c *Client) joinPath(p string) (string, error) {
	u, err := url.Parse(c.baseURL)
	if err != nil {
		return "", err
	}
	u.Path = path.Join(u.Path, p)
	return u.String(), nil
}
