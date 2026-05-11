import { useState, useEffect } from 'react';

interface ConfigFormProps {
  initialConfig: {
    attendanceHours: string;
    whatsappNumber: string;
    otherSettings: string;
  };
  onSave: (config: { attendanceHours: string; whatsappNumber: string; otherSettings: string }) => void;
}

export function ConfigForm({ initialConfig, onSave }: ConfigFormProps) {
  const [config, setConfig] = useState(initialConfig);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConfig((prevConfig) => ({
      ...prevConfig,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="attendanceHours" className="block text-sm font-medium text-gray-700">
          Horários de Atendimento
        </label>
        <input
          type="text"
          id="attendanceHours"
          name="attendanceHours"
          value={config.attendanceHours}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Ex: 08:00-12:00, 14:00-18:00"
        />
      </div>
      <div>
        <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700">
          Número do WhatsApp
        </label>
        <input
          type="text"
          id="whatsappNumber"
          name="whatsappNumber"
          value={config.whatsappNumber}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Ex: +5511999999999"
        />
      </div>
      <div>
        <label htmlFor="otherSettings" className="block text-sm font-medium text-gray-700">
          Outras Configurações
        </label>
        <textarea
          id="otherSettings"
          name="otherSettings"
          value={config.otherSettings}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          rows={4}
          placeholder="Digite outras configurações relevantes..."
        />
      </div>
      <div>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Salvar Configurações
        </button>
      </div>
    </form>
  );
}