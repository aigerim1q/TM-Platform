package utils

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const maxNameAttempts = 10

func SaveUploadedFile(file multipart.File, header *multipart.FileHeader, folder string) (string, string, error) {
	if file == nil {
		return "", "", errors.New("file is required")
	}
	if header == nil {
		return "", "", errors.New("file header is required")
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		return "", "", errors.New("missing file extension")
	}

	if err := EnsureFolder(folder); err != nil {
		return "", "", err
	}

	for i := 0; i < maxNameAttempts; i++ {
		fileName, err := buildFileName(ext)
		if err != nil {
			return "", "", err
		}

		fullPath := filepath.Join(folder, fileName)
		out, err := os.OpenFile(fullPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if err != nil {
			if errors.Is(err, os.ErrExist) {
				continue
			}
			return "", "", err
		}

		if _, err := file.Seek(0, io.SeekStart); err != nil {
			_ = out.Close()
			_ = os.Remove(fullPath)
			return "", "", err
		}

		if _, err := io.Copy(out, file); err != nil {
			_ = out.Close()
			_ = os.Remove(fullPath)
			return "", "", err
		}

		if err := out.Close(); err != nil {
			_ = os.Remove(fullPath)
			return "", "", err
		}

		return fullPath, fileName, nil
	}

	return "", "", fmt.Errorf("failed to generate a unique filename after %d attempts", maxNameAttempts)
}

func EnsureFolder(path string) error {
	return os.MkdirAll(path, 0o755)
}

func buildFileName(ext string) (string, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	randomPart, err := randomHex(4)
	if err != nil {
		return "", err
	}

	return timestamp + "_" + randomPart + ext, nil
}

func randomHex(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	return hex.EncodeToString(buf), nil
}
