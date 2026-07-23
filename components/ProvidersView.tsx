"use client";

type ProviderRow = {
  name: string;
};

type ProvidersViewProps = {
  customProviderRows: ProviderRow[];
  defaultProviderRows: ProviderRow[];
  onAddLogins: () => void;
  onEditProvider: (providerName: string) => void;
};

export default function ProvidersView({
  customProviderRows,
  defaultProviderRows,
  onAddLogins,
  onEditProvider,
}: ProvidersViewProps) {
  return (
    <section className="account-page">
      <article className="form-card provider-page-card">
        <div className="provider-table provider-database">
          <div className="provider-table-head" aria-hidden="true">
            <span>Provider Name</span>
            <span>Action</span>
          </div>

          <div className="provider-database-section-row">
            <span>Default</span>
            <span>{defaultProviderRows.length}</span>
          </div>

          {defaultProviderRows.map((providerRow) => (
            <div className="provider-table-row provider-table-row-default" key={providerRow.name}>
              <span data-label="Provider Name">{providerRow.name}</span>
            </div>
          ))}

          <div className="provider-database-section-row">
            <span>Custom</span>
            <span>{customProviderRows.length}</span>
          </div>

          {customProviderRows.length > 0 ? (
            customProviderRows.map((providerRow) => (
              <div className="provider-table-row" key={providerRow.name}>
                <span data-label="Provider Name">{providerRow.name}</span>
                <span data-label="Action">
                  <button
                    className="action-btn"
                    onClick={() => onEditProvider(providerRow.name)}
                    type="button"
                  >
                    Edit
                  </button>
                </span>
              </div>
            ))
          ) : (
            <div className="empty-state compact-empty provider-empty-row">
              <strong>No custom providers yet</strong>
              <span>
                Add one from{" "}
                <button className="inline-text-link" onClick={onAddLogins} type="button">
                  + Add Logins
                </button>
                .
              </span>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
