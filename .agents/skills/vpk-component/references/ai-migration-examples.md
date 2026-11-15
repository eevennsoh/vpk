# Common Migration Patterns

> Before/after examples for migrating custom AI components to ui-custom compound components.

## Message Bubble → Message

```tsx
// BEFORE: Custom message bubble
function MessageBubble({ message }) {
  return (
    <div className={cn(
      "rounded-lg p-3",
      message.role === "user" ? "bg-blue-100 ml-auto" : "bg-surface-raised"
    )}>
      <div dangerouslySetInnerHTML={{ __html: message.html }} />
    </div>
  );
}

// AFTER: ui-custom Message
import { Message, MessageContent, MessageResponse } from "@/components/ui-custom/message";

function ChatMessage({ message }) {
  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return <MessageResponse key={i}>{part.text}</MessageResponse>;
          }
          return null;
        })}
      </MessageContent>
    </Message>
  );
}
```

## Scroll Container → Conversation

```tsx
// BEFORE: Custom scroll
function ChatScroll({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [children]);
  return <div ref={ref} className="overflow-y-auto h-full">{children}</div>;
}

// AFTER: ui-custom Conversation
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui-custom/conversation";

function ChatContainer({ children }) {
  return (
    <Conversation>
      <ConversationContent>{children}</ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
```

## Suggestion Buttons → Suggestions

```tsx
// BEFORE: Custom suggestions
function SuggestionBar({ items, onSelect }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {items.map((item) => (
        <button key={item} onClick={() => onSelect(item)}
          className="rounded-full border px-3 py-1 text-sm">
          {item}
        </button>
      ))}
    </div>
  );
}

// AFTER: ui-custom Suggestions
import { Suggestions, Suggestion } from "@/components/ui-custom/suggestion";

function SuggestionBar({ items, onSelect }) {
  return (
    <Suggestions>
      {items.map((item) => (
        <Suggestion key={item} suggestion={item} onClick={(s) => onSelect(s)} />
      ))}
    </Suggestions>
  );
}
```

## Message Actions → MessageActions

```tsx
// BEFORE: Custom action bar
function ActionBar({ onCopy, onRetry }) {
  return (
    <div className="flex gap-1 mt-1">
      <button onClick={onCopy}><CopyIcon className="size-4" /></button>
      <button onClick={onRetry}><RefreshCwIcon className="size-4" /></button>
    </div>
  );
}

// AFTER: ui-custom MessageActions
import { MessageActions, MessageAction } from "@/components/ui-custom/message";

// Inside a <Message> compound:
<MessageActions>
  <MessageAction onClick={onCopy} tooltip="Copy">
    <CopyIcon className="size-4" />
  </MessageAction>
  <MessageAction onClick={onRetry} tooltip="Retry">
    <RefreshCwIcon className="size-4" />
  </MessageAction>
</MessageActions>
```

## Code Display → CodeBlock

```tsx
// BEFORE: Custom code block
function CustomCode({ code, language }) {
  return (
    <pre className="bg-muted rounded p-4 overflow-x-auto">
      <code>{code}</code>
    </pre>
  );
}

// AFTER: ui-custom CodeBlock
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
} from "@/components/ui-custom/code-block";

function CodeDisplay({ code, language, filename }) {
  return (
    <CodeBlock code={code} language={language}>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <CodeBlockFilename>{filename}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  );
}
```
