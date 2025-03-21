const ChatMessage = ({ role, content }) => {
  return (
    <div className={`flex w-full ${role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-4 m-2 
          ${role === 'assistant' 
            ? 'bg-blue-100 ml-auto' 
            : 'bg-gray-100'
          }`}
      >
        {content}
      </div>
    </div>
  );
}; 