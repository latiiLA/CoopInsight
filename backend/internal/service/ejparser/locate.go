package ejparser

import (
	"fmt"
	"os"
	"strings"

	"github.com/latiiLA/CoopInsight/backend/internal/domain/model"
)

// LocateTip is enough metadata to find a block inside an EJ file without an offset.
type LocateTip struct {
	AtmType    string
	StartTime  string
	EndTime    string
	AuthNum    string
	CardFirst4 string
	CardLast4  string
	Amount     float64
}

// LocatedBlock is one matched journal transaction block.
type LocatedBlock struct {
	RawText   string
	Offset    int64
	LineStart int
	LineEnd   int
}

// LocateTransactionBlock finds the best matching START…END block in path.
func LocateTransactionBlock(path string, tip LocateTip) (*LocatedBlock, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, os.ErrNotExist
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	data := NormalizeEJText(string(raw))
	atmType := strings.TrimSpace(tip.AtmType)
	if atmType == "" {
		atmType = DetectAtmType(data)
	}

	var parsed []parsedTxn
	switch atmType {
	case model.EJAtmTypeNCR:
		parsed, _ = parseNCR(data)
	default:
		parsed, _ = parseCRM(data)
	}
	if len(parsed) == 0 {
		return nil, fmt.Errorf("no transaction blocks in file")
	}

	bestIdx := -1
	bestScore := -1
	for i, p := range parsed {
		score := scoreBlock(p, tip)
		if score > bestScore {
			bestScore = score
			bestIdx = i
		}
	}
	if bestIdx < 0 || bestScore < 1 {
		return nil, fmt.Errorf("no matching journal block")
	}
	p := parsed[bestIdx]
	lineStart := 1 + strings.Count(data[:p.relStart], "\n")
	lineEnd := 1 + strings.Count(data[:maxInt(p.relEnd-1, p.relStart)], "\n")
	return &LocatedBlock{
		RawText:   p.rawText,
		Offset:    int64(p.relStart),
		LineStart: lineStart,
		LineEnd:   lineEnd,
	}, nil
}

func scoreBlock(p parsedTxn, tip LocateTip) int {
	score := 0
	first4, last4, _ := normalizeCard(p.cardRaw)

	if tip.AuthNum != "" && p.authnum != "" && tip.AuthNum == p.authnum {
		score += 8
	}
	if tip.StartTime != "" && p.startTime != "" && tip.StartTime == p.startTime {
		score += 4
	}
	if tip.EndTime != "" && p.endTime != "" && tip.EndTime == p.endTime {
		score += 2
	}
	if tip.CardFirst4 != "" && first4 != "" && tip.CardFirst4 == first4 {
		score += 3
	}
	if tip.CardLast4 != "" && last4 != "" {
		if tip.CardLast4 == last4 || strings.HasSuffix(last4, tip.CardLast4) || strings.HasSuffix(tip.CardLast4, last4) {
			score += 3
		}
	}
	if tip.Amount > 0 && p.amount > 0 {
		diff := tip.Amount - p.amount
		if diff < 0 {
			diff = -diff
		}
		if diff < 0.005 {
			score += 2
		}
	}
	return score
}
