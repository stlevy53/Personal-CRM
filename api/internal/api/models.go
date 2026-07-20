package api

import "time"

// JSON shapes mirror the CRM.* contract in assets/js/data.js so the React port
// can talk to this API without reshaping data.

type Subdivision struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Studio struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	SubdivisionID string `json:"subdivisionId"`
}

type AppStatus struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Badge string `json:"badge"`
}

type Pod struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Person struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Initials string `json:"initials"`
	PodID    string `json:"podId"`
}

type TeamNote struct {
	ID        string    `json:"id"`
	AuthorID  string    `json:"authorId"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"createdAt"`
}

type Customer struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	StudioID     string     `json:"studioId"`
	AppStatus    string     `json:"appStatus"`
	SlackChannel string     `json:"slackChannel"`
	Services     []string   `json:"services"`
	Contacts     []string   `json:"contacts"`
	Notes        []TeamNote `json:"notes"`
}

type Contact struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Slack      string `json:"slack"`
	Role       string `json:"role"`
	CustomerID string `json:"customerId"`
}

type ActionItem struct {
	Text    string  `json:"text"`
	OwnerID *string `json:"ownerId"`
	DueDate *string `json:"dueDate"`
	Status  string  `json:"status"`
}

type Interaction struct {
	ID                string       `json:"id"`
	Type              string       `json:"type"`
	Title             string       `json:"title"`
	Date              time.Time    `json:"date"`
	Notes             string       `json:"notes"`
	Sentiment         string       `json:"sentiment"`
	ActionItems       []ActionItem `json:"actionItems"`
	Tags              []string     `json:"tags"`
	AttendeesInternal []string     `json:"attendeesInternal"`
	AttendeesExternal []string     `json:"attendeesExternal"`
	CustomerID        string       `json:"customerId"`
	LoggedBy          string       `json:"loggedBy"`
	CreatedAt         time.Time    `json:"createdAt"`
}

type AuditEntry struct {
	ID         string    `json:"id"`
	Timestamp  time.Time `json:"timestamp"`
	ActorID    string    `json:"actorId"`
	Action     string    `json:"action"`
	RecordType string    `json:"recordType"`
	RecordID   string    `json:"recordId"`
	Detail     string    `json:"detail"`
}

type Stats struct {
	Interactions int `json:"interactions"`
	Teams        int `json:"teams"`
	Contacts     int `json:"contacts"`
	Last30       int `json:"last30"`
}
