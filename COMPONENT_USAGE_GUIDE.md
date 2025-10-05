# Component Usage Guide

Quick reference for using all the new UI components in your app.

## Layout Components

### MainLayout

Full-screen app wrapper that manages sidebar, top bar, and content.

```tsx
<MainLayout
  sidebar={<Sidebar items={sidebarItems} header={<Logo />} footer={<Status />} />}
  topBar={<TopBar title="My App" actions={<Button>Action</Button>} />}
>
  <ContentContainer>
    {/* Your content here */}
  </ContentContainer>
</MainLayout>
```

### Sidebar

Animated sidebar with navigation items.

```tsx
const sidebarItems = [
  {
    id: 'chat',
    icon: MessageSquare,
    label: 'Chat',
    description: 'AI Assistant',
    onClick: () => setView('chat'),
    active: view === 'chat',
  },
];

<Sidebar
  items={sidebarItems}
  header={<div>Header Content</div>}
  footer={<div>Footer Content</div>}
/>
```

### TopBar

Top navigation bar with title and actions.

```tsx
<TopBar
  title="My App"
  actions={<Button>Action</Button>}
  breadcrumbs={<span>Home / Page</span>}
/>
```

### ContentContainer

Scrollable content wrapper with max-width options.

```tsx
// Centered content
<ContentContainer maxWidth="lg" padding="md">
  {/* Content */}
</ContentContainer>

// Full width
<ContentContainer maxWidth="full" padding="none">
  {/* Content */}
</ContentContainer>
```

## UI Components

### Button

Versatile button with multiple variants and states.

```tsx
// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>

// With icon
<Button icon={<Send />}>Send</Button>

// Loading state
<Button loading={isLoading}>Loading...</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
```

### Card

Animated card component.

```tsx
// Basic card
<Card>
  <h3>Title</h3>
  <p>Content</p>
</Card>

// Hoverable card with gradient
<Card hoverable gradient onClick={() => {}}>
  <h3>Interactive Card</h3>
</Card>
```

### Input

Styled text input with label and error support.

```tsx
<Input
  label="Email"
  placeholder="Enter your email"
  icon={<Mail />}
  error="Invalid email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
```

### TextArea

Multi-line text input with ref support.

```tsx
const textareaRef = useRef<HTMLTextAreaElement>(null);

<TextArea
  ref={textareaRef}
  label="Message"
  placeholder="Type your message..."
  rows={4}
  value={message}
  onChange={(e) => setMessage(e.target.value)}
/>
```

### Badge

Status indicator badges.

```tsx
<Badge variant="success">Connected</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
<Badge variant="info">3 items</Badge>

// With animation
<Badge variant="success" animate>New!</Badge>

// Sizes
<Badge size="sm">Small</Badge>
<Badge size="md">Medium</Badge>
<Badge size="lg">Large</Badge>
```

### IconButton

Icon-only button with hover effects.

```tsx
<IconButton
  icon={<Trash2 />}
  variant="ghost"
  tooltip="Delete"
  onClick={() => {}}
/>

// Variants
<IconButton icon={<Plus />} variant="primary" />
<IconButton icon={<Edit />} variant="secondary" />
<IconButton icon={<X />} variant="ghost" />

// Sizes
<IconButton icon={<Star />} size="sm" />
<IconButton icon={<Star />} size="md" />
<IconButton icon={<Star />} size="lg" />
```

### QuickActionCard

Feature card for quick actions.

```tsx
<QuickActionCard
  icon={Brain}
  title="Create Flashcards"
  description="Generate study flashcards"
  onClick={() => {}}
  gradient="from-purple-500 to-pink-500"
  delay={0.1}
/>
```

### MessageBubble

Chat message component.

```tsx
<MessageBubble
  role="user"
  content="Hello, how can you help me?"
  timestamp={new Date()}
/>

<MessageBubble
  role="assistant"
  content="I can help you with studying!"
  timestamp={new Date()}
/>

<MessageBubble
  role="system"
  content="Connection established"
  timestamp={new Date()}
/>
```

### LoadingSpinner

Animated loading indicator.

```tsx
<LoadingSpinner size="sm" />
<LoadingSpinner size="md" />
<LoadingSpinner size="lg" />
```

## Animation Patterns

### Entrance Animations

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content with fade and slide
</motion.div>
```

### Hover Animations

```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Interactive element
</motion.button>
```

### Staggered Lists

```tsx
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
  >
    {item.content}
  </motion.div>
))}
```

## Styling Patterns

### Gradients

```tsx
// Background gradients
className="bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50"
className="bg-gradient-to-r from-purple-500 to-pink-500"

// Text gradients
className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
```

### Glassmorphism

```tsx
className="bg-white/80 backdrop-blur-xl border border-gray-200"
className="bg-black/40 backdrop-blur-xl border border-white/10"
```

### Shadows

```tsx
className="shadow-lg"
className="shadow-xl"
className="shadow-2xl"
className="shadow-lg shadow-purple-500/30"
```

## Layout Patterns

### Grid Layout

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => (
    <Card key={item.id}>{item.content}</Card>
  ))}
</div>
```

### Flex Layout

```tsx
// Horizontal with gap
<div className="flex items-center gap-3">
  <Button variant="ghost">Cancel</Button>
  <Button variant="primary">Confirm</Button>
</div>

// Vertical stack
<div className="space-y-4">
  <Card>First item</Card>
  <Card>Second item</Card>
  <Card>Third item</Card>
</div>
```

### Full Height Layout

```tsx
<div className="flex flex-col h-full">
  <div className="flex-shrink-0">Fixed Header</div>
  <div className="flex-1 overflow-y-auto">Scrollable Content</div>
  <div className="flex-shrink-0">Fixed Footer</div>
</div>
```

## Common Utilities

### cn() - Class Name Utility

Combine class names conditionally:

```tsx
import { cn } from './lib/utils';

<div className={cn(
  'base-class',
  condition && 'conditional-class',
  variant === 'primary' && 'primary-class',
  className
)}>
```

## Best Practices

1. **Use semantic HTML** - Button for actions, Card for containers
2. **Consistent spacing** - Use Tailwind's spacing scale (gap-3, gap-4, gap-6)
3. **Animation delays** - Stagger list items with index * 0.05
4. **Loading states** - Always show loading feedback for async actions
5. **Error handling** - Display errors in Cards or inline with inputs
6. **Accessibility** - Use tooltips, labels, and ARIA attributes
7. **Responsive design** - Use md: and lg: breakpoints for grid layouts

## Example: Complete View

```tsx
import React, { useState } from 'react';
import { ContentContainer } from '../components/layout';
import { Button, Card, Input, Badge } from '../components/ui';
import { Save, Plus } from 'lucide-react';

export const MyView: React.FC = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  return (
    <ContentContainer maxWidth="lg" padding="md">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">My View</h2>
          <Badge variant="info">{items.length} items</Badge>
        </div>
        <Button
          icon={<Plus />}
          onClick={() => {}}
        >
          Add Item
        </Button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item, index) => (
          <Card key={item.id} hoverable>
            <h3 className="font-bold mb-2">{item.title}</h3>
            <p className="text-gray-600">{item.description}</p>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <Card className="text-center py-16">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-bold mb-2">No items yet</h3>
          <p className="text-gray-600 mb-6">Get started by adding your first item</p>
          <Button icon={<Plus />}>Add First Item</Button>
        </Card>
      )}
    </ContentContainer>
  );
};
```
