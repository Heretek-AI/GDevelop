// @flow
import * as React from 'react';
import CompactSelectField from '../../UI/CompactSelectField';
import SelectOption from '../../UI/SelectOption';
import SemiControlledTextField from '../../UI/SemiControlledTextField';
import RaisedButton from '../../UI/RaisedButton';
import { Column, Line, Spacer } from '../../UI/Grid';
import Text from '../../UI/Text';

type ByokConfigState = {|
  provider: string,
  endpoint: string,
  apiKey: string,
  model: string,
  hasApiKey: boolean,
|};

type FeedbackState = {|
  type: 'success' | 'error' | null,
  message: string,
|};

const PROVIDER_OPTIONS: Array<{ value: string, label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'groq', label: 'Groq' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'deepseek', label: 'DeepSeek' },
];

const ByokConfigPanel = (): React.Node => {
  const [config, setConfig] = React.useState<ByokConfigState>({
    provider: 'openai',
    endpoint: '',
    apiKey: '',
    model: '',
    hasApiKey: false,
  });
  const [feedback, setFeedback] = React.useState<FeedbackState>({
    type: null,
    message: '',
  });

  // Load current config from IPC on mount.
  React.useEffect(() => {
    let cancelled = false;

    // $FlowFixMe — window.byokAi is exposed by the Electron preload script
    if (!window.byokAi) {
      console.info(
        '[ByokConfigPanel] window.byokAi not available — running outside Electron?'
      );
      return;
    }

    // $FlowFixMe — window.byokAi is exposed by the Electron preload script
    window.byokAi
      .getConfig()
      .then((loadedConfig: any) => {
        if (cancelled) return;
        console.info('[ByokConfigPanel] Config loaded successfully', {
          provider: loadedConfig.provider,
          model: loadedConfig.model,
          hasApiKey: loadedConfig.hasApiKey,
        });
        setConfig({
          provider: loadedConfig.provider || 'openai',
          endpoint: loadedConfig.endpoint || '',
          apiKey: '', // Never pre-fill apiKey — the renderer receives a masked key
          model: loadedConfig.model || '',
          hasApiKey: loadedConfig.hasApiKey || false,
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.info('[ByokConfigPanel] Config load failed', err);
        setFeedback({
          type: 'error',
          message: 'Failed to load configuration.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = React.useCallback(
    () => {
      // $FlowFixMe — window.byokAi is exposed by the Electron preload script
      if (!window.byokAi) {
        setFeedback({ type: 'error', message: 'BYOK bridge not available.' });
        return;
      }

      const configToSave = {
        provider: config.provider,
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        model: config.model,
      };

      // $FlowFixMe — window.byokAi is exposed by the Electron preload script
      window.byokAi
        .saveConfig(configToSave)
        .then(() => {
          console.info('[ByokConfigPanel] Config saved successfully');
          setFeedback({ type: 'success', message: 'Configuration saved.' });
          // Clear the key field after save (it will show as masked on next load)
          setConfig(prev => ({ ...prev, apiKey: '', hasApiKey: true }));
        })
        .catch((err: any) => {
          console.info('[ByokConfigPanel] Config save failed', err);
          setFeedback({
            type: 'error',
            message: 'Failed to save configuration.',
          });
        });
    },
    [config]
  );

  const hasByokBridge =
    // $FlowFixMe — window.byokAi is exposed by the Electron preload script
    typeof window !== 'undefined' && !!window.byokAi;

  if (!hasByokBridge) {
    return (
      <Column noMargin>
        <Text size="body2" color="secondary">
          BYOK configuration is only available in the desktop app.
        </Text>
      </Column>
    );
  }

  return (
    <Column noMargin>
      <CompactSelectField
        value={config.provider}
        onChange={(value: string) =>
          setConfig(prev => ({ ...prev, provider: value }))
        }
      >
        {PROVIDER_OPTIONS.map(opt => (
          <SelectOption
            key={opt.value}
            value={opt.value}
            label={opt.label}
            shouldNotTranslate
          />
        ))}
      </CompactSelectField>
      <SemiControlledTextField
        floatingLabelText="Endpoint URL"
        value={config.endpoint}
        onChange={(value: string) =>
          setConfig(prev => ({ ...prev, endpoint: value }))
        }
        fullWidth
        type="text"
        translatableHintText={undefined}
      />
      {config.hasApiKey ? (
        <Text size="body2" noMargin>
          ✅ Key saved
        </Text>
      ) : (
        <SemiControlledTextField
          floatingLabelText="API Key"
          value={config.apiKey}
          onChange={(value: string) =>
            setConfig(prev => ({ ...prev, apiKey: value }))
          }
          fullWidth
          type="text"
          translatableHintText={undefined}
        />
      )}
      <SemiControlledTextField
        floatingLabelText="Model"
        value={config.model}
        onChange={(value: string) =>
          setConfig(prev => ({ ...prev, model: value }))
        }
        fullWidth
        type="text"
        translatableHintText={undefined}
      />
      <Line noMargin alignItems="center">
        <RaisedButton label="Save" primary onClick={handleSave} />
        {feedback.type && (
          <>
            <Spacer />
            <Text
              size="body2"
              color={feedback.type === 'error' ? 'error' : 'primary'}
              noMargin
            >
              {feedback.message}
            </Text>
          </>
        )}
      </Line>
    </Column>
  );
};

export default ByokConfigPanel;
