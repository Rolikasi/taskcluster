// This source code file is AUTO-GENERATED by github.com/taskcluster/jsonschema2go

package tcnotify

import (
	"encoding/json"
	"errors"
)

type (
	// Request to post a message on IRC.
	//
	// See https://taskcluster-staging.net/schemas/notify/v1/irc-request.json#/oneOf[0]
	ChannelMessage struct {

		// Channel to post the message in.
		//
		// Syntax:     ^[#&][^ ,\u0007]{1,199}$
		// Min length: 1
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/irc-request.json#/oneOf[0]/properties/channel
		Channel string `json:"channel"`

		// IRC message to send as plain text.
		//
		// Min length: 1
		// Max length: 510
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/irc-request.json#/definitions/message
		Message string `json:"message"`
	}

	// Optional link that can be added as a button to the email.
	//
	// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#/properties/link
	Link struct {

		// Where the link should point to.
		//
		// Min length: 1
		// Max length: 1024
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#/properties/link/properties/href
		Href string `json:"href"`

		// Text to display on link.
		//
		// Min length: 1
		// Max length: 40
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#/properties/link/properties/text
		Text string `json:"text"`
	}

	// List of notification addresses.
	//
	// See https://taskcluster-staging.net/schemas/notify/v1/notification-address-list.json#
	ListOfNotificationAdresses struct {

		// See https://taskcluster-staging.net/schemas/notify/v1/notification-address-list.json#/properties/addresses
		Addresses []NotificationTypeAndAddress `json:"addresses"`

		// A continuation token is returned if there are more results than listed
		// here. You can optionally provide the token in the request payload to
		// load the additional results.
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/notification-address-list.json#/properties/continuationToken
		ContinuationToken string `json:"continuationToken,omitempty"`
	}

	// Type of notification and its corresponding address.
	//
	// See https://taskcluster-staging.net/schemas/notify/v1/notification-address.json#
	NotificationTypeAndAddress struct {

		// See https://taskcluster-staging.net/schemas/notify/v1/notification-address.json#/properties/notificationAddress
		NotificationAddress string `json:"notificationAddress"`

		// Possible values:
		//   * "email"
		//   * "pulse"
		//   * "irc-user"
		//   * "irc-channel"
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/notification-address.json#/properties/notificationType
		NotificationType string `json:"notificationType"`
	}

	// Request to post a message on IRC.
	//
	// One of:
	//   * ChannelMessage
	//   * PrivateMessage
	//
	// See https://taskcluster-staging.net/schemas/notify/v1/irc-request.json#
	PostIRCMessageRequest json.RawMessage

	// Request to post a message on pulse.
	//
	// See https://taskcluster-staging.net/schemas/notify/v1/pulse-request.json#
	PostPulseMessageRequest struct {

		// IRC message to send as plain text.
		//
		// Additional properties allowed
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/pulse-request.json#/properties/message
		Message json.RawMessage `json:"message"`

		// Routing-key to use when posting the message.
		//
		// Max length: 255
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/pulse-request.json#/properties/routingKey
		RoutingKey string `json:"routingKey"`
	}

	// Request to post a message on IRC.
	//
	// See https://taskcluster-staging.net/schemas/notify/v1/irc-request.json#/oneOf[1]
	PrivateMessage struct {

		// IRC message to send as plain text.
		//
		// Min length: 1
		// Max length: 510
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/irc-request.json#/definitions/message
		Message string `json:"message"`

		// User to post the message to.
		//
		// Syntax:     ^[A-Za-z\[\]\\~_\^{|}][A-Za-z0-9\-\[\]\\~_\^{|}]{0,254}$
		// Min length: 1
		// Max length: 255
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/irc-request.json#/oneOf[1]/properties/user
		User string `json:"user"`
	}

	// Request to send an email
	//
	// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#
	SendEmailRequest struct {

		// E-mail address to which the message should be sent
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#/properties/address
		Address string `json:"address"`

		// Content of the e-mail as **markdown**, will be rendered to HTML before
		// the email is sent. Notice that markdown allows for a few HTML tags, but
		// won't allow inclusion of script tags and other unpleasantries.
		//
		// Min length: 1
		// Max length: 102400
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#/properties/content
		Content string `json:"content"`

		// Optional link that can be added as a button to the email.
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#/properties/link
		Link Link `json:"link,omitempty"`

		// Reply-to e-mail (this property is optional)
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#/properties/replyTo
		ReplyTo string `json:"replyTo,omitempty"`

		// Subject line of the e-mail, this is plain-text
		//
		// Min length: 1
		// Max length: 255
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#/properties/subject
		Subject string `json:"subject"`

		// E-mail html template used to format your content.
		//
		// Possible values:
		//   * "simple"
		//   * "fullscreen"
		//
		// Default:    "simple"
		//
		// See https://taskcluster-staging.net/schemas/notify/v1/email-request.json#/properties/template
		Template string `json:"template,omitempty"`
	}
)

// MarshalJSON calls json.RawMessage method of the same name. Required since
// PostIRCMessageRequest is of type json.RawMessage...
func (this *PostIRCMessageRequest) MarshalJSON() ([]byte, error) {
	x := json.RawMessage(*this)
	return (&x).MarshalJSON()
}

// UnmarshalJSON is a copy of the json.RawMessage implementation.
func (this *PostIRCMessageRequest) UnmarshalJSON(data []byte) error {
	if this == nil {
		return errors.New("PostIRCMessageRequest: UnmarshalJSON on nil pointer")
	}
	*this = append((*this)[0:0], data...)
	return nil
}
