interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming = false }: MessageBubbleProps) {
  const isUser = role === 'user';

  // Formata o texto da IA com suporte básico a markdown (negrito e listas)
  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        // Bullet points
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <li key={i} className="ml-4 list-disc">
              {formatInline(line.slice(2))}
            </li>
          );
        }
        // Linhas em branco
        if (line.trim() === '') return <br key={i} />;
        return <p key={i} className="mb-1">{formatInline(line)}</p>;
      });
  };

  const formatInline = (text: string) => {
    // Negrito: **texto**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar IA */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-3 mt-1">
          <span className="text-white text-xs font-bold">IA</span>
        </div>
      )}

      {/* Balão de mensagem */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            {formatContent(content)}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse rounded-sm" />
            )}
          </div>
        )}
      </div>

      {/* Avatar Secretária */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center ml-3 mt-1">
          <span className="text-white text-xs font-bold">Sec</span>
        </div>
      )}
    </div>
  );
}