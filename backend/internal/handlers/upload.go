package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"tm-platform-backend/internal/utils"
)

const (
	maxFileSize    int64 = 50 << 20
	maxRequestSize int64 = maxFileSize + (1 << 20)
)

var allowedExtensions = map[string]map[string]struct{}{
	"image": {
		".png":  {},
		".jpg":  {},
		".jpeg": {},
		".webp": {},
	},
	"video": {
		".mp4": {},
		".mov": {},
	},
	"file": {
		".pdf":  {},
		".doc":  {},
		".docx": {},
		".xls":  {},
	},
}

type UploadHandler struct {
	baseDir string
}

func NewUploadHandler(baseDir string) (*UploadHandler, error) {
	if strings.TrimSpace(baseDir) == "" {
		baseDir = "uploads"
	}

	folders := []string{
		baseDir,
		filepath.Join(baseDir, "images"),
		filepath.Join(baseDir, "videos"),
		filepath.Join(baseDir, "files"),
	}

	for _, folder := range folders {
		if err := utils.EnsureFolder(folder); err != nil {
			return nil, err
		}
	}

	return &UploadHandler{baseDir: baseDir}, nil
}

func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestSize)

	reader, err := r.MultipartReader()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart form"})
		return
	}

	var (
		fileType  string
		tmpFile   *os.File
		fileSize  int64
		fileName  string
		fileFound bool
	)

	defer func() {
		if tmpFile == nil {
			return
		}
		_ = tmpFile.Close()
		_ = os.Remove(tmpFile.Name())
	}()

	for {
		part, nextErr := reader.NextPart()
		if errors.Is(nextErr, io.EOF) {
			break
		}
		if nextErr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart form"})
			return
		}

		if err := func() error {
			defer part.Close()

			switch part.FormName() {
			case "type":
				typeBytes, err := io.ReadAll(io.LimitReader(part, 32))
				if err != nil {
					return err
				}
				fileType = strings.ToLower(strings.TrimSpace(string(typeBytes)))
				return nil
			case "file":
				if fileFound {
					return errors.New("only one file is allowed")
				}

				originalName := filepath.Base(part.FileName())
				if originalName == "" {
					return errors.New("file is required")
				}

				f, err := os.CreateTemp("", "tm-platform-upload-*")
				if err != nil {
					return err
				}

				limited := io.LimitReader(part, maxFileSize+1)
				written, err := io.Copy(f, limited)
				if err != nil {
					_ = f.Close()
					_ = os.Remove(f.Name())
					return err
				}
				if written == 0 {
					_ = f.Close()
					_ = os.Remove(f.Name())
					return errors.New("empty file")
				}
				if written > maxFileSize {
					_ = f.Close()
					_ = os.Remove(f.Name())
					return errors.New("file exceeds 50MB limit")
				}

				tmpFile = f
				fileSize = written
				fileName = originalName
				fileFound = true
				return nil
			default:
				_, _ = io.Copy(io.Discard, part)
				return nil
			}
		}(); err != nil {
			status := http.StatusBadRequest
			if strings.Contains(err.Error(), "50MB") {
				status = http.StatusRequestEntityTooLarge
			}
			writeJSON(w, status, map[string]string{"error": err.Error()})
			return
		}
	}

	if !fileFound {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file is required"})
		return
	}
	if fileType == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "type is required"})
		return
	}

	folderName := fileTypeFolder(fileType)
	if folderName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid type"})
		return
	}

	if err := validateExtension(fileName, fileType); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to process file"})
		return
	}

	header := &multipart.FileHeader{
		Filename: fileName,
		Size:     fileSize,
	}
	targetFolder := filepath.Join(h.baseDir, folderName)

	_, savedFileName, err := utils.SaveUploadedFile(tmpFile, header, targetFolder)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save file"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"url":            "/uploads/" + folderName + "/" + savedFileName,
		"fileName":       fileName,
		"storedFileName": savedFileName,
	})
}

func fileTypeFolder(fileType string) string {
	switch fileType {
	case "image":
		return "images"
	case "video":
		return "videos"
	case "file":
		return "files"
	default:
		return ""
	}
}

func validateExtension(originalName string, fileType string) error {
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext == "" {
		return errors.New("missing file extension")
	}

	allowedForType, ok := allowedExtensions[fileType]
	if !ok {
		return errors.New("invalid type")
	}

	if _, allowed := allowedForType[ext]; !allowed {
		return errors.New("unsupported file extension")
	}

	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
